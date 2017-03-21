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
        </div>
       </div>
       <?php if (is_page('about-us')){ ?>
         <div class="row services">
            <div class="small-12 medium-3 large-3 columns">
              <img src="<?php echo get_bloginfo('template_url'); ?>/assets/images/01.jpg">
              <p>Organizzazione degli eventi a 360</p>
            </div>
            <div class="small-12 medium-3 large-3 columns">
              <img src="<?php echo get_bloginfo('template_url'); ?>/assets/images/02.jpg">
              <p>Operational marketing: logistica, allestimenti e permessi</p>
            </div>
            <div class="small-12 medium-3 large-3 columns">
              <img src="<?php echo get_bloginfo('template_url'); ?>/assets/images/03.jpg">
              <p>Gestione del personale: hostess, supervisor e mascotte</p>
            </div>
            <div class="small-12 medium-3 large-3 columns">
              <img src="<?php echo get_bloginfo('template_url'); ?>/assets/images/04.jpg">
              <p>Attivazioni sul punto vendita</p>
            </div>
         </div>
        <?php  }?>
   </article>
   <?php if (is_page('chi-siamo')){ ?>
<section id="page-chi-siamo">
     <div class="content">
   				<?php
   				$args = array(
   						'post_type' => 'dipendenti',
              'order'=> ASC,
   						'posts_per_page' => 10
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
                <img src="<?php echo $image['url']; ?>" class="filtro-grigio">
                <div class="cornerLink show-for-large">
                  <a href="mailto:<?php echo $email; ?>" class="sendmail">
                    <i class="fi-mail"></i>
                  </a>
                </div>
          </div>
          <!--h4><?php echo get_the_title(); ?></h4-->
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
