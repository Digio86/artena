<?php get_header(); ?>

 <?php get_template_part( 'template-parts/featured-image' ); ?>

 <div id="page" role="main">

 <?php while ( have_posts() ) : the_post(); ?>
   <header>
       <h1 class="entry-title"><?php the_title(); ?></h1>
   </header>
   <article>

       <div class="entry-content">
           <?php the_content(); ?>
<<<<<<< HEAD
        </div>

=======
           <?php edit_post_link( __( 'Edit', 'foundationpress' ), '<span class="edit-link">', '</span>' ); ?>
       </div>
       <footer>
          <?php
            wp_link_pages(
              array(
                'before' => '<nav id="page-nav"><p>' . __( 'Pages:', 'foundationpress' ),
                'after'  => '</p></nav>',
              )
            );
          ?>
          <p><?php the_tags(); ?></p>
       </footer>
       <?php do_action( 'foundationpress_page_before_comments' ); ?>
       <?php comments_template(); ?>
       <?php do_action( 'foundationpress_page_after_comments' ); ?>
>>>>>>> c067a86f5e526ab35eb48a25577ddc07f372e181
   </article>
   <?php if (is_page('chi-siamo')){ ?>
<section id="page-chi-siamo" class="hideme">
     <div class="content">
   				<?php
   				$args = array(
   						'post_type' => 'dipendenti',
              'order'=> ASC,
   						'posts_per_page' => 6
   					);

   				$the_query = new WP_Query( $args );

   				if ( $the_query->have_posts() ) :
   					while ( $the_query->have_posts() ) : $the_query->the_post();
   						$image = get_field('foto');
   						$email = get_field('email');
   						$mansione = get_field('mansione');

   						if( !empty($image) ):
   				?>
          <div class="persona">
            <div class="image-wrapper">
                <img src="<?php echo $image['url']; ?>">
                <div class="cornerLink show-for-large">
                  <a href="mailto:<?php echo $email; ?>" class="sendmail">
                    <i class="fi-mail"></i>
                  </a>
                </div>


          </div>
          <h4><?php echo get_the_title(); ?></h4>
          <div class="address show-for-small hide-for-large">
            <a href="mailto:<?php echo $email; ?>">
              E-mail
            </a>
          </div>

        </div>
   				<?php
   	          endif;
   	        endwhile;
   	      endif;
   	      wp_reset_postdata();

   	?>
      </div>
</section>
  <?php  }?>

 <?php endwhile;?>
 </div>

 <?php get_footer();
